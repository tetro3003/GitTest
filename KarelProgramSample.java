/*
 * File: CheckerboardKarel.java
 * ----------------------------
 * When you finish writing it, the CheckerboardKarel class should draw
 * a checkerboard using beepers, as described in Assignment 1.  You
 * should make sure that your program works for all of the sample
 * worlds supplied in the starter folder.
 */

import stanford.karel.*;

public class KarelProgramSample extends SuperKarel {

	// You fill in this part
	
	@Override
	public void run() {
		
		pickAndPutBeepers();
	 
		
	}
	
	private void moveToBeeper(){
		
		move();
		move();
		move();
	}
	
	private void pickAndPutBeepers(){
		int a;
		int b;
		int c;
		move();
		 while (beepersPresent()){
			pickBeeper();
			a=+1;
			
			if(noBeepersPresent()){
				move();
				while (beepersPresent()){
			}
				pickBeeper();
				b=+1;
				if(noBeepersPresent()){move();
				for(c = 0; c<a+b; c++){putBeeper();}}
			}
		}
		 
		
	}
	
	private void fillRoad() {
		 while (frontIsClear()) {
			 if(noBeepersPresent()){putBeeper();}
			 move();
			 if(beepersPresent()){
				 turnLeft();
				 turnLeft();
				 move();
				 turnLeft();
				 turnLeft();
				 turnLeft();
			 }
			 if(frontIsClear());
			 else turnLeft();
			 
		 }
		 putBeeper();
		 
		 
		} 

	private void pickBeepers(){
		
		for(int i=0; i<10; i++){
			pickBeeper();
		}
	}
	
	private void putBeepers(){
		for(int b=0; b<10; b++){putBeeper();
	}}
	
	private void moveToTarget(){
		move();
	}
}
