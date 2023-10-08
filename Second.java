import stanford.karel.SuperKarel;

public class Second extends SuperKarel{
	
	public void run() {
		
		moveToBeepers();
		pickTenBeepers();
		move();
		putTenBeepers();
		
		
	}
	
	private void moveToBeepers(){
		
		for(int i=0; i<4; i++){
			
			move();
			
		}
		
	}
	
	private void pickTenBeepers(){
		
		for(int i=0; i<10; i++){
			
			pickBeeper();
			
		}
		
	}
	
	private void putTenBeepers(){
		
		for(int i=0; i<10; i++){
			
			pickBeeper();
			
		}
		
	}

}
