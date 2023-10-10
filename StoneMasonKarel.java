import stanford.karel.Karel;

public class StoneMasonKarel extends Karel {
	
	public void run(){
		
		
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
		if(noBeepersPresent()) {
			putBeeper();
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
	turnLeft();
	while(frontIsClear()){
		
		if(noBeepersPresent()){
			putBeeper();
		}
		else move();
		
	}
	turnLeft();
	turnLeft();
	while(frontIsClear()) move();
	turnLeft();
	}
}
