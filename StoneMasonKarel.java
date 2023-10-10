import stanford.karel.Karel;

public class StoneMasonKarel extends Karel {
	
	public void run(){
		
		turnLeft();
		rebuilder();
		
	}
	
	private void rebuilder(){
	
	while(frontIsClear()){
		
		turnLeft();
	
		while(frontIsClear()){
			
				if(noBeepersPresent()) {
					putBeeper();
					move();
					
		}else move();
	
	}
		turnLeft();
		turnLeft();
		

		while(frontIsClear()){
			move();
		}
		
		turnLeft();
		
		move();
		move();
		move();
		move();	
	}
	}
}
